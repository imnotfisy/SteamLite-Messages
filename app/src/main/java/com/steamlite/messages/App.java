package com.steamlite.messages;

import android.app.Application;
import android.content.Context;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

/** Starts Firebase (push) with the project's settings when the Firebase plugin was not used for this app. */
public class App extends Application {
    @Override public void onCreate() { super.onCreate(); ensureFirebase(this); }

    static void ensureFirebase(Context c) {
        try {
            if (!FirebaseApp.getApps(c).isEmpty() || BuildConfig.FB_APP_ID.isEmpty()) return;
            FirebaseApp.initializeApp(c, new FirebaseOptions.Builder().setApplicationId(BuildConfig.FB_APP_ID).setApiKey(BuildConfig.FB_API_KEY).setProjectId(BuildConfig.FB_PROJECT).setGcmSenderId(BuildConfig.FB_SENDER).build());
        } catch (Throwable e) { }
    }
}
