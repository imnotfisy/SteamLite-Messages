package com.steamlite.messages;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.drawable.Icon;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/** Quick Settings tile: one tap turns SteamLite's Do Not Disturb (quiet notifications) on or off. */
public class DndTile extends TileService {
    private SharedPreferences sp() { return getSharedPreferences("sl", Context.MODE_PRIVATE); }

    @Override public void onStartListening() { paint(); }

    @Override public void onClick() {
        boolean on = !sp().getBoolean("dndOn", false);
        sp().edit().putBoolean("dndOn", on).putBoolean("dndTile", on).apply();
        paint();
    }

    private void paint() {
        Tile t = getQsTile(); if (t == null) return;
        boolean on = sp().getBoolean("dndOn", false);
        t.setState(on ? Tile.STATE_ACTIVE : Tile.STATE_INACTIVE);
        t.setLabel("SteamLite quiet");
        if (android.os.Build.VERSION.SDK_INT >= 29) t.setSubtitle(on ? "On" : "Off");
        t.setIcon(Icon.createWithResource(this, R.drawable.ic_stat));
        t.updateTile();
    }
}
