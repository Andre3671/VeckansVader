package se.veckansvader.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.view.View
import androidx.core.content.ContextCompat
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Background job that:
 *  1. Tries to get the user's current location (last known GPS/network).
 *  2. Falls back to the saved location written by the Capacitor app.
 *  3. Calls /api/estimate?lat=&lon= and renders the result.
 *
 * Uses Android's built-in LocationManager — no Google Play Services required.
 */
class WeatherWidgetWorker(
    appContext: Context,
    params: WorkerParameters,
) : Worker(appContext, params) {

    companion object {
        // The plugin's `group` config may or may not be honoured by the
        // current @capacitor/preferences version, so check both names.
        private val PREFS_CANDIDATES = listOf(
            "VeckansVaderPrefs",
            "CapacitorStorage",
        )
        private const val LOC_KEY = "last_location"
        private const val API_BASE = "https://veckansvader.se"
    }

    override fun doWork(): Result {
        val loc = resolveLocation()
        if (loc == null) {
            val reason = diagnoseEmpty()
            return renderEmptyAndDone(reason)
        }

        val today = try {
            fetchToday(loc.lat, loc.lon)
        } catch (e: Exception) {
            return Result.retry()
        }

        // If the location came from GPS (no label), reverse-geocode it so the
        // widget shows a city name instead of raw coordinates. Best-effort.
        val resolvedLabel = if (loc.label.isEmpty()) {
            runCatching { reverseGeocode(loc.lat, loc.lon) }.getOrNull()
                ?: "${"%.2f".format(loc.lat)}, ${"%.2f".format(loc.lon)}"
        } else loc.label

        WeatherWidget.updateAllInstances(applicationContext) { views ->
            views.setTextViewText(R.id.widget_location, resolvedLabel)
            views.setTextViewText(R.id.widget_temp, today.tempLine)
            views.setTextViewText(R.id.widget_condition, today.conditionLabel)
            views.setTextViewText(R.id.widget_icon, today.emoji)
            views.setTextViewText(R.id.widget_metrics, today.metricsLine)
            views.setViewVisibility(R.id.widget_empty, View.GONE)
            views.setViewVisibility(R.id.widget_content, View.VISIBLE)
        }
        return Result.success()
    }

    private fun reverseGeocode(lat: Double, lon: Double): String? {
        val url = URL("$API_BASE/api/geocode?lat=$lat&lon=$lon")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "VeckansVaderWidget/1.0")
            connectTimeout = 5_000
            readTimeout = 5_000
        }
        try {
            if (conn.responseCode !in 200..299) return null
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            val r = JSONObject(body).optJSONObject("result") ?: return null
            val name = r.optString("label", "")
            return name.ifEmpty { null }
        } finally {
            conn.disconnect()
        }
    }

    private data class ResolvedLocation(
        val lat: Double,
        val lon: Double,
        val label: String,
    )

    /**
     * Priority order:
     *   1. Last known location from GPS or network provider (live position).
     *   2. Location persisted by the main app's last successful forecast.
     *
     * Returns null if neither is available — caller renders the "open app" state.
     */
    private fun resolveLocation(): ResolvedLocation? {
        gpsLocation()?.let { return it }
        return savedLocation()
    }

    private fun gpsLocation(): ResolvedLocation? {
        val ctx = applicationContext

        val hasFine = ContextCompat.checkSelfPermission(
            ctx, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ContextCompat.checkSelfPermission(
            ctx, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (!hasFine && !hasCoarse) return null

        val lm = ContextCompat.getSystemService(ctx, LocationManager::class.java) ?: return null

        // Pick the freshest available location across enabled providers.
        // Order: GPS (most accurate when available), then network/fused.
        val providers = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER,
        )
        var best: Location? = null
        for (p in providers) {
            try {
                if (!lm.isProviderEnabled(p)) continue
                val loc = lm.getLastKnownLocation(p) ?: continue
                if (best == null || loc.time > best.time) best = loc
            } catch (_: SecurityException) {
                // permission revoked between checks — bail
                return null
            } catch (_: IllegalArgumentException) {
                // provider doesn't exist on this device
            }
        }

        val l = best ?: return null
        // Reject stale fixes older than 24h — likely useless.
        val ageMs = System.currentTimeMillis() - l.time
        if (ageMs > 24L * 3600 * 1000) return null

        return ResolvedLocation(l.latitude, l.longitude, label = "")
    }

    private fun savedLocation(): ResolvedLocation? {
        for (name in PREFS_CANDIDATES) {
            val prefs = applicationContext.getSharedPreferences(name, Context.MODE_PRIVATE)
            val raw = prefs.getString(LOC_KEY, null) ?: continue
            val json = parseLocation(raw) ?: continue
            val lat = json.optDouble("lat", Double.NaN)
            val lon = json.optDouble("lon", Double.NaN)
            if (lat.isNaN() || lon.isNaN()) continue
            return ResolvedLocation(lat, lon, label = json.optString("label", ""))
        }
        return null
    }

    /** Build a one-line user-facing reason when we have nothing to show. */
    private fun diagnoseEmpty(): String {
        val ctx = applicationContext

        val hasFine = ContextCompat.checkSelfPermission(
            ctx, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ContextCompat.checkSelfPermission(
            ctx, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasFine && !hasCoarse) {
            return "Öppna appen och tillåt position"
        }

        // Permission OK but no GPS fix and no saved location.
        val anyPrefsFile = PREFS_CANDIDATES.any { name ->
            ctx.getSharedPreferences(name, Context.MODE_PRIVATE)
                .getString(LOC_KEY, null) != null
        }
        return if (!anyPrefsFile) {
            "Öppna appen för att ladda prognosen"
        } else {
            "Inget GPS-fix — försöker igen"
        }
    }

    private fun renderEmptyAndDone(reason: String = "Öppna appen för att välja plats"): Result {
        WeatherWidget.updateAllInstances(applicationContext) { views ->
            views.setTextViewText(R.id.widget_empty, reason)
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
            views.setViewVisibility(R.id.widget_content, View.GONE)
        }
        return Result.success()
    }

    private fun parseLocation(raw: String): JSONObject? {
        return try {
            JSONObject(raw)
        } catch (_: Exception) {
            try {
                val inner = JSONObject().put("v", raw).getString("v")
                JSONObject(inner)
            } catch (_: Exception) {
                null
            }
        }
    }

    private data class DayRender(
        val tempLine: String,
        val conditionLabel: String,
        val emoji: String,
        val metricsLine: String,
    )

    private fun fetchToday(lat: Double, lon: Double): DayRender {
        val url = URL("$API_BASE/api/estimate?lat=$lat&lon=$lon")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "VeckansVaderWidget/1.0")
            connectTimeout = 10_000
            readTimeout = 10_000
        }
        try {
            val code = conn.responseCode
            if (code !in 200..299) throw RuntimeException("HTTP $code")
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            val json = JSONObject(body)
            val forecast = json.getJSONArray("forecast")
            if (forecast.length() == 0) throw RuntimeException("Empty forecast")
            val day = forecast.getJSONObject(0)
            val temp = day.getJSONObject("temperature")
            val tMin = temp.optDouble("min", Double.NaN)
            val tMax = temp.optDouble("max", Double.NaN)
            val cond = day.optString("condition", "unknown")
            val precip = day.getJSONObject("precipitation").optDouble("mm", 0.0)
            val wind = day.getJSONObject("wind").optDouble("mean_ms", 0.0)
            return DayRender(
                tempLine = formatTempRange(tMin, tMax),
                conditionLabel = labelFor(cond),
                emoji = emojiFor(cond),
                metricsLine = "💧 ${"%.1f".format(precip)} mm  ·  💨 ${"%.1f".format(wind)} m/s",
            )
        } finally {
            conn.disconnect()
        }
    }

    private fun formatTempRange(min: Double, max: Double): String {
        if (min.isNaN() || max.isNaN()) return "–"
        return "${min.toInt()}° / ${max.toInt()}°"
    }

    private fun emojiFor(c: String): String = when (c) {
        "clear" -> "☀️"
        "partly-cloudy" -> "⛅"
        "cloudy" -> "☁️"
        "fog" -> "🌫️"
        "rain-light" -> "🌦️"
        "rain" -> "🌧️"
        "rain-heavy" -> "⛈️"
        "snow" -> "❄️"
        "sleet" -> "🌨️"
        "thunder" -> "⛈️"
        else -> "❔"
    }

    private fun labelFor(c: String): String = when (c) {
        "clear" -> "Klart"
        "partly-cloudy" -> "Växlande molnighet"
        "cloudy" -> "Mulet"
        "fog" -> "Dimma"
        "rain-light" -> "Lätt regn"
        "rain" -> "Regn"
        "rain-heavy" -> "Kraftigt regn"
        "snow" -> "Snö"
        "sleet" -> "Snöblandat regn"
        "thunder" -> "Åska"
        else -> "—"
    }
}
