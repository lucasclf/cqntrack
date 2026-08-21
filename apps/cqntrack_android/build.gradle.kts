// Top-level: nenhum plugin é aplicado aqui de fato, só declarado (apply
// false) pra cada módulo pedir a versão certa sem repetir o número —
// versão real vem do version catalog (gradle/libs.versions.toml).
//
// Sem "kotlin.android" aqui de propósito: a partir da AGP 9.0, suporte a
// Kotlin é embutido no plugin com.android.application/library — aplicar
// org.jetbrains.kotlin.android separadamente agora é erro de build, não só
// redundância (ver https://kotl.in/gradle/agp-built-in-kotlin). Os outros
// plugins Kotlin (compose, serialization, ksp) continuam precisando ser
// aplicados à parte.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.hilt.android) apply false
}
