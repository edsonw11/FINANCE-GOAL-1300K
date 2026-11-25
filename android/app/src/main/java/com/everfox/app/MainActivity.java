package com.everfox.app;

import android.content.res.Configuration;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Plugins of our own must be registered before the bridge starts. */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppLockPlugin.class);
        super.onCreate(savedInstanceState);
    }

    /**
     * The system theme can change while the app is open (a scheduled dark mode, a quick setting). The Capacitor SystemBars plugin then
     * puts back the icon style it had resolved earlier, so the clock and battery stay dark on a dark page (or light on a light one).
     * Resolving the style again here, after the plugin ran, keeps the icons readable.
     */
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        boolean night = (newConfig.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setAppearanceLightStatusBars(!night);
        bars.setAppearanceLightNavigationBars(!night);
    }
}
