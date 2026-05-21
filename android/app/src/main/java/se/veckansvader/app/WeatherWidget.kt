package se.veckansvader.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Home-screen widget showing today's forecast for the user's last-selected
 * location. Updates every 30 minutes via WorkManager.
 *
 * Tapping the widget opens the main app.
 *
 * Architecture:
 *   - User opens app and picks a place. The JS side writes lat/lon to
 *     SharedPreferences("VeckansVaderPrefs").
 *   - This widget reads that pref and triggers WeatherWidgetWorker.
 *   - The worker fetches /api/estimate?lat=&lon= from veckansvader.se,
 *     updates the RemoteViews with the result, and notifies the
 *     AppWidgetManager.
 */
class WeatherWidget : AppWidgetProvider() {

    companion object {
        private const val PERIODIC_WORK_NAME = "weather_widget_periodic"

        /** Push an updated RemoteViews into every installed instance of the widget. */
        fun updateAllInstances(context: Context, render: (RemoteViews) -> Unit) {
            val mgr = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, WeatherWidget::class.java)
            val ids = mgr.getAppWidgetIds(component)
            if (ids.isEmpty()) return
            val views = RemoteViews(context.packageName, R.layout.widget_weather)
            render(views)
            // Tap anywhere on the widget → open app.
            val openAppIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            val pendingIntent = PendingIntent.getActivity(
                context, 0, openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)
            for (id in ids) mgr.updateAppWidget(id, views)
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        // Kick off an immediate fetch.
        WorkManager.getInstance(context).enqueue(
            OneTimeWorkRequestBuilder<WeatherWidgetWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()
        )
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        // Schedule periodic refresh every 30 minutes (Android's minimum).
        val periodic = PeriodicWorkRequestBuilder<WeatherWidgetWorker>(
            30, TimeUnit.MINUTES
        )
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            PERIODIC_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            periodic,
        )
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        // Last instance removed — stop refreshing.
        WorkManager.getInstance(context).cancelUniqueWork(PERIODIC_WORK_NAME)
    }
}
