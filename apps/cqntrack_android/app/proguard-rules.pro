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
