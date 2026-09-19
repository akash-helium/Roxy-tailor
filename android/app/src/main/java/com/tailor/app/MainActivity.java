package com.tailor.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.OnApplyWindowInsetsListener;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(true);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        final View bridgeRoot = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(bridgeRoot, new OnApplyWindowInsetsListener() {
            @Override
            public WindowInsetsCompat onApplyWindowInsets(View v, WindowInsetsCompat insets) {
                Insets bars = insets.getInsets(
                        WindowInsetsCompat.Type.systemBars()
                                | WindowInsetsCompat.Type.displayCutout()
                );
                Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());

                float density = getResources().getDisplayMetrics().density;
                final int topPx = (int) (bars.top / density);
                final int bottomPx = (int) (Math.max(bars.bottom, ime.bottom) / density);
                final int leftPx = (int) (bars.left / density);
                final int rightPx = (int) (bars.right / density);

                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null) {
                    final String js =
                            "(function(){var r=document.documentElement;" +
                                    "r.style.setProperty('--android-safe-top','" + topPx + "px');" +
                                    "r.style.setProperty('--android-safe-bottom','" + bottomPx + "px');" +
                                    "r.style.setProperty('--android-safe-left','" + leftPx + "px');" +
                                    "r.style.setProperty('--android-safe-right','" + rightPx + "px');" +
                                    "})();";
                    webView.post(new Runnable() {
                        @Override
                        public void run() {
                            webView.evaluateJavascript(js, null);
                        }
                    });
                }

                return WindowInsetsCompat.CONSUMED;
            }
        });
    }
}
