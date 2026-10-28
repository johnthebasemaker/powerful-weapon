# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ── Powerful Weapon release (R8) ────────────────────────────────────────────
# Keep line numbers so Play Console crash reports de-obfuscate with mapping.txt.
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod
-renamesourcefileattribute SourceFile

# Capacitor bridge + plugins: methods are called by name from JavaScript.
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
-keep class com.getcapacitor.community.database.sqlite.** { *; }
-keep class de.mindlib.sendIntent.** { *; }
-keep class io.capawesome.capacitorjs.plugins.** { *; }

# SQLCipher (used by @capacitor-community/sqlite): JNI looks up these by name.
-keep class net.zetetic.** { *; }
-keepclasseswithmembernames class * { native <methods>; }
-dontwarn net.zetetic.**

# WebView JavaScript interfaces.
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }

# Compile-time-only annotations referenced by Google Tink (androidx.security-crypto).
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
