package com.steamlite.messages;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        if (!c.getSharedPreferences("sl", Context.MODE_PRIVATE).getString("token", "").isEmpty()) PollService.schedule(c);
    }
}
