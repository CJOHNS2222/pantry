package com.smart.pantry;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CookingModePlugin")
public class CookingModePlugin extends Plugin {

    @PluginMethod
    public void enableCookingMode(PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity is null");
            return;
        }

        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    // 1. Force landscape orientation
                    activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);

                    // 2. Hide status bar (notification bar) and navigation buttons
                    Window window = activity.getWindow();

                    // targetSdk 35+ forces edge-to-edge; the WebView's touchable region can
                    // become stale relative to its visual bounds across the orientation change
                    // below unless we explicitly re-run the inset/layout pass (hiding bars via
                    // WindowInsetsController alone no longer triggers this reliably).
                    WindowCompat.setDecorFitsSystemWindows(window, false);

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        WindowInsetsController controller = window.getInsetsController();
                        if (controller != null) {
                            controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                            controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                        }
                    } else {
                        View decorView = window.getDecorView();
                        decorView.setSystemUiVisibility(
                            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        );
                    }

                    final View content = window.getDecorView();
                    content.post(new Runnable() {
                        @Override
                        public void run() {
                            content.requestLayout();
                            refreshWebViewTouchRegion();
                        }
                    });

                    call.resolve();
                } catch (Exception e) {
                    call.reject("Failed to enable cooking mode: " + e.getMessage(), e);
                }
            }
        });
    }

    @PluginMethod
    public void disableCookingMode(PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity is null");
            return;
        }

        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    // 1. Reset/unlock screen orientation
                    activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);

                    // 2. Show status bar and navigation buttons
                    Window window = activity.getWindow();
                    WindowCompat.setDecorFitsSystemWindows(window, true);

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        WindowInsetsController controller = window.getInsetsController();
                        if (controller != null) {
                            controller.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                        }
                    } else {
                        View decorView = window.getDecorView();
                        decorView.setSystemUiVisibility(
                            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        );
                    }

                    final View content = window.getDecorView();
                    content.post(new Runnable() {
                        @Override
                        public void run() {
                            content.requestLayout();
                            refreshWebViewTouchRegion();
                        }
                    });

                    call.resolve();
                } catch (Exception e) {
                    call.reject("Failed to disable cooking mode: " + e.getMessage(), e);
                }
            }
        });
    }

    // A decorView.requestLayout() re-lays-out the activity's view tree, but Chromium's
    // internal touch hit-test region for the WebView isn't necessarily recomputed from
    // that alone — it needs the WebView itself to see a real size change. Toggling its
    // measured size by 1px and back forces WebView.onSizeChanged, which re-syncs the
    // hit-test region with the view's actual (post-rotation/inset) bounds.
    private void refreshWebViewTouchRegion() {
        Activity activity = getActivity();
        if (activity == null) return;

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;

        final int width = webView.getWidth();
        final int height = webView.getHeight();
        if (width <= 0 || height <= 0) return;

        webView.requestLayout();
        webView.setRight(webView.getLeft() + width - 1);
        webView.post(new Runnable() {
            @Override
            public void run() {
                webView.setRight(webView.getLeft() + width);
                webView.requestLayout();
                webView.invalidate();
            }
        });
    }
}
