package com.everfox.app;

import static androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK;
import static androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL;

import android.view.WindowManager;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The app lock: asks Android to confirm the person with a fingerprint, a face or the phone's own PIN / pattern / password.
 * The app keeps no secret of its own. Android does the check and only says yes or no.
 * Weak biometrics plus the device credential are used because the strong-plus-credential pair is not supported on Android 9 and 10.
 */
@CapacitorPlugin(name = "AppLock")
public class AppLockPlugin extends Plugin {

    private static final int AUTHENTICATORS = BIOMETRIC_WEAK | DEVICE_CREDENTIAL;

    /** {available, reason}: available when the phone has a screen lock (or biometric) the prompt can use. */
    @PluginMethod
    public void status(PluginCall call) {
        int result = BiometricManager.from(getContext()).canAuthenticate(AUTHENTICATORS);
        JSObject out = new JSObject();
        out.put("available", result == BiometricManager.BIOMETRIC_SUCCESS);
        out.put("reason", reasonOf(result));
        call.resolve(out);
    }

    /** Resolves when the person is confirmed; rejects with the code cancelled, lockout, unavailable or failed. */
    @PluginMethod
    public void authenticate(PluginCall call) {
        String title = call.getString("title", "Everfox");
        String subtitle = call.getString("subtitle", "");
        getActivity().runOnUiThread(() -> {
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setAllowedAuthenticators(AUTHENTICATORS)
                .build();
            BiometricPrompt prompt = new BiometricPrompt(
                getActivity(),
                ContextCompat.getMainExecutor(getContext()),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        call.resolve();
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        call.reject(String.valueOf(errString), codeOf(errorCode));
                    }
                }
            );
            prompt.authenticate(info);
        });
    }

    /** Hides the app from the recent-apps list and from screenshots (FLAG_SECURE) while the lock is on. */
    @PluginMethod
    public void setSecure(PluginCall call) {
        boolean secure = Boolean.TRUE.equals(call.getBoolean("secure", false));
        getActivity().runOnUiThread(() -> {
            if (secure) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }

    static String reasonOf(int result) {
        switch (result) {
            case BiometricManager.BIOMETRIC_SUCCESS:
                return "";
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                return "none-enrolled";
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                return "no-hardware";
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                return "hardware-unavailable";
            default:
                return "unsupported";
        }
    }

    static String codeOf(int errorCode) {
        switch (errorCode) {
            case BiometricPrompt.ERROR_USER_CANCELED:
            case BiometricPrompt.ERROR_NEGATIVE_BUTTON:
            case BiometricPrompt.ERROR_CANCELED:
                return "cancelled";
            case BiometricPrompt.ERROR_LOCKOUT:
            case BiometricPrompt.ERROR_LOCKOUT_PERMANENT:
                return "lockout";
            case BiometricPrompt.ERROR_NO_BIOMETRICS:
            case BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL:
            case BiometricPrompt.ERROR_HW_NOT_PRESENT:
            case BiometricPrompt.ERROR_HW_UNAVAILABLE:
                return "unavailable";
            default:
                return "failed";
        }
    }
}
