# Regras específicas do app além do padrão do AGP (proguard-android-optimize.txt).
# kotlinx.serialization e Retrofit precisam de algumas manutenções de nome/
# assinatura pra sobreviver ao R8 — mantidas mínimas por enquanto, revisar
# se algo quebrar no primeiro build de release de verdade.

-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclasseswithmembers class xyz.cqn.cqntrack.**.*Dto {
    *** Companion;
}
-keepclasseswithmembers class xyz.cqn.cqntrack.**.*Dto$Companion {
    kotlinx.serialization.KSerializer serializer(...);
}

# google-tink (usado por androidx.security.crypto/EncryptedSharedPreferences em :core:auth)
# referencia anotações do errorprone que só existem em tempo de compilação — não afetam
# comportamento em runtime, só suprime o warning do R8. Gerado por missing_rules.txt no
# primeiro build de release de verdade (as versões debug não passam pelo R8).
-dontwarn com.google.errorprone.annotations.CanIgnoreReturnValue
-dontwarn com.google.errorprone.annotations.CheckReturnValue
-dontwarn com.google.errorprone.annotations.Immutable
-dontwarn com.google.errorprone.annotations.RestrictedApi
