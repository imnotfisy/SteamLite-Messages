package com.steamlite.messages;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

/** Android reports how the install is going here: it may ask the person to confirm, then succeeds or fails. */
public class InstallReceiver extends BroadcastReceiver {
    static final String ACTION = "com.steamlite.messages.INSTALL_STATUS";

    @Override
    @SuppressWarnings("deprecation")
    public void onReceive(Context c, Intent i) {
        int st = i.getIntExtra(PackageInstaller.EXTRA_STATUS, -1);
        if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = i.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) { confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); try { c.startActivity(confirm); } catch (Exception e) { Updater.error = "Android would not open the install screen."; Updater.state = "error"; } }
        } else if (st == PackageInstaller.STATUS_SUCCESS) {
            Updater.state = "done";
        } else {
            String m = i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            Updater.error = st == PackageInstaller.STATUS_FAILURE_ABORTED ? "The install was cancelled."
                    : (st == PackageInstaller.STATUS_FAILURE_CONFLICT || st == PackageInstaller.STATUS_FAILURE_INCOMPATIBLE) ? "Android says this update cannot replace the installed app (it was signed with a different key). Uninstall SteamLite and install the new file instead."
                    : (m == null || m.isEmpty() ? "The install did not finish." : m);
            Updater.state = "error";
        }
    }
}
