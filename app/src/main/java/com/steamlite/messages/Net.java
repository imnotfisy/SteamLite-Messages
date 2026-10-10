package com.steamlite.messages;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** One small HTTP helper shared by the page bridge and the background check. */
final class Net {
    static final String BASE = "https://steamlite-online.bayxturtle.workers.dev";

    static boolean hostAllowed(String h) {
        return h.endsWith(".workers.dev") || h.equals("raw.githubusercontent.com") || h.endsWith("steampowered.com") || h.endsWith("steamstatic.com") || h.endsWith("steamcommunity.com");
    }

    /** Returns {code, body}. code 0 means no connection. */
    static Object[] call(String method, String url, org.json.JSONObject headers, String body) {
        int code = 0; String out = "";
        try {
            URL u = new URL(url);
            if (!"https".equals(u.getProtocol())) throw new Exception("https only");
            if (!hostAllowed(u.getHost())) throw new Exception("host not allowed");
            HttpURLConnection c = (HttpURLConnection) u.openConnection();
            c.setRequestMethod(method);
            c.setConnectTimeout(12000);
            c.setReadTimeout(25000);
            if (headers != null) for (java.util.Iterator<String> it = headers.keys(); it.hasNext(); ) { String k = it.next(); c.setRequestProperty(k, headers.getString(k)); }
            if (body != null && !body.isEmpty()) { c.setDoOutput(true); OutputStream os = c.getOutputStream(); os.write(body.getBytes("UTF-8")); os.close(); }
            code = c.getResponseCode();
            InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (is != null) {
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                byte[] buf = new byte[8192]; int n;
                while ((n = is.read(buf)) > 0 && bo.size() < 8 * 1024 * 1024) bo.write(buf, 0, n);
                is.close();
                out = bo.toString("UTF-8");
            }
        } catch (Exception e) { code = 0; out = String.valueOf(e.getMessage()); }
        return new Object[]{code, out};
    }
}
