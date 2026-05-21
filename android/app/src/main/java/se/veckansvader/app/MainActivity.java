package se.veckansvader.app;

import androidx.work.Constraints;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onResume() {
        super.onResume();
        // Refresh the home-screen widget whenever the user returns to the app.
        // Catches the common case of "widget added before forecast was loaded":
        // the user opens the app, the location is saved to SharedPreferences,
        // and on the next onResume the widget worker re-runs with that data.
        WorkManager.getInstance(getApplicationContext()).enqueue(
            new OneTimeWorkRequest.Builder(WeatherWidgetWorker.class)
                .setConstraints(
                    new Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()
        );
    }
}
