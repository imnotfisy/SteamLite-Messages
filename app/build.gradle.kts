import java.util.Properties

plugins {
    id("com.android.application")
}

// release signing: the key lives in ../signing (never uploaded). Updates only install over an earlier
// version when they are signed with the SAME key, so keep a backup of that folder.
val keyProps = Properties().apply {
    val f = rootProject.file("signing/keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "com.steamlite.messages"
    buildFeatures { buildConfig = true }
    compileSdk {
        version = release(36)
    }

    defaultConfig {
        applicationId = "com.steamlite.messages"
        minSdk = 26
        targetSdk = 36
        versionCode = 5
        versionName = "1.0.4"
        // push: when this app is registered in Firebase (google-services.json holds its package), the plugin below is used.
        // Until then the Firebase settings of the SteamLite Mobile project are used, read from the same file.
        val gs = file("google-services.json")
        if (gs.exists()) {
            @Suppress("UNCHECKED_CAST") val j = groovy.json.JsonSlurper().parse(gs) as Map<String, Any>
            val info = j["project_info"] as Map<String, Any>
            @Suppress("UNCHECKED_CAST") val cl = (j["client"] as List<Map<String, Any>>)[0]
            @Suppress("UNCHECKED_CAST") val ci = cl["client_info"] as Map<String, Any>
            @Suppress("UNCHECKED_CAST") val key = ((cl["api_key"] as List<Map<String, Any>>)[0])["current_key"]
            buildConfigField("String", "FB_APP_ID", "\"" + ci["mobilesdk_app_id"] + "\"")
            buildConfigField("String", "FB_API_KEY", "\"" + key + "\"")
            buildConfigField("String", "FB_PROJECT", "\"" + info["project_id"] + "\"")
            buildConfigField("String", "FB_SENDER", "\"" + info["project_number"] + "\"")
        } else {
            buildConfigField("String", "FB_APP_ID", "\"\""); buildConfigField("String", "FB_API_KEY", "\"\""); buildConfigField("String", "FB_PROJECT", "\"\""); buildConfigField("String", "FB_SENDER", "\"\"")
        }
    }

    signingConfigs {
        if (keyProps.containsKey("storeFile")) {
            create("release") {
                storeFile = rootProject.file("signing/" + File(keyProps.getProperty("storeFile")).name)
                storePassword = keyProps.getProperty("storePassword")
                keyAlias = keyProps.getProperty("keyAlias")
                keyPassword = keyProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (keyProps.containsKey("storeFile")) signingConfig = signingConfigs.getByName("release")
        }
    }
    lint {
        checkReleaseBuilds = false
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

// use the Firebase plugin only when google-services.json really contains this app
val gsFile = file("google-services.json")
if (gsFile.exists() && gsFile.readText().contains("com.steamlite.messages")) apply(plugin = "com.google.gms.google-services")

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:35.0.0"))
    implementation("com.google.firebase:firebase-messaging")
    implementation("com.google.zxing:core:3.5.3")   // draws your friend-code QR
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")   // scans a friend's QR (no camera permission needed)
}





