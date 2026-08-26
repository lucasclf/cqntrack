---
name: android-kotlin-dev
description: Builda, testa e roda no emulador o app Android nativo em Kotlin/Compose do cqntrack — apps/cqntrack_android (NÃO o wrapper Capacitor antigo, ver skill android-release para esse). Use ao continuar o desenvolvimento do app nativo, adicionar uma nova seção de mídia nele, ou depurar um problema de build/runtime específico dessa stack (Gradle multi-módulo, Hilt, Compose, Retrofit).
---

# Dev do app Android nativo (Kotlin/Compose) — apps/cqntrack_android

Projeto novo, começado em 2026-08-21, **separado** de `apps/cqntrack_mobile` (o wrapper Capacitor
antigo — ver skill `android-release` para esse). Gradle multi-módulo: `:app`, `:core:network`,
`:core:auth`, `:core:designsystem`. Consome a mesma API REST do backend (`apps/cqntrack_be`) via
Retrofit — nenhuma mudança de backend foi necessária, o plugin `bearer()` do better-auth
(`apps/cqntrack_be/src/auth/auth.ts`) já existia para o Capacitor e serve o cliente nativo do mesmo
jeito (`Authorization: Bearer <token>`, token vindo do header `set-auth-token` da resposta de
login/cadastro — ver `core/auth/AuthRepository.kt`).

`applicationId` é `xyz.cqn.cqntrack.dev` (não o `xyz.cqn.cqntrack` de produção) de propósito — deixa
instalar lado a lado com o app Capacitor no mesmo aparelho pra comparação. Trocar pro id de verdade
só no corte final, quando este app substituir o Capacitor.

## Build

```bash
cd "g:/projetos/cqntrack/apps/cqntrack_android"
JAVA_HOME="/c/Users/lucas/.jdks/corretto-21.0.6" ./gradlew :app:assembleDebug --no-daemon
```

APK sai em `app/build/outputs/apk/debug/app-debug.apk`. `local.properties` (SDK path) já existe e é
gitignored — se sumir, recriar com `sdk.dir=C\:\\Users\\lucas\\AppData\\Local\\Android\\Sdk`.

## Testes

```bash
JAVA_HOME="/c/Users/lucas/.jdks/corretto-21.0.6" ./gradlew :core:auth:testDebugUnitTest --no-daemon
# ou todos os módulos:
JAVA_HOME="/c/Users/lucas/.jdks/corretto-21.0.6" ./gradlew testDebugUnitTest --no-daemon
```

JUnit5 (Jupiter) + MockK + Turbine — ver `core/auth/src/test/.../AuthRepositoryTest.kt` como
referência de padrão (mock de `Retrofit.Response` com header customizado via `okhttp3.Response.Builder`
pra testar leitura de `set-auth-token`).

## Testar contra produção com dado real (recomendado)

Todas as rotas de mídia exigem sessão — testar sem login só cobre telas de auth/navegação, não pega
bug de UI com dado real (2 bugs reais só apareceram assim: contador que não atualizava na primeira
marcação, tela que travava sem scroll com sinopse longa). Existe uma conta de teste reutilizável em
produção, confirmada pelo usuário — **não apagar, usar sempre que precisar**:

```
email: android-smoketest-1787319523@cqntrack.dev
senha: SenhaTeste12345!
```

Login de verdade pela UI do app (não bypass de estado) é o jeito preferido de validar. Via
`adb shell input`:

```bash
ADB="/c/Users/lucas/AppData/Local/Android/Sdk/platform-tools/adb.exe"
"$ADB" shell input tap <x> <y>              # tap no campo e-mail
"$ADB" shell input text 'android-smoketest-1787319523@cqntrack.dev'
"$ADB" shell input tap <x> <y>              # tap no campo senha
"$ADB" shell input text 'SenhaTeste12345!'
"$ADB" shell input keyevent 4               # fecha o teclado antes de tocar em "Entrar" (o teclado cobre o botão)
"$ADB" shell input tap <x> <y>              # tap em "Entrar"
```

**Gotchas do `adb shell input text`:**

- `%s` vira espaço — não usar `%s` achando que escapa outro caractere (gerou senha errada com
  espaço extra numa sessão real: `'Senha%s!'` virou `"Senha !"`, não `"Senha!"`).
- Espaço literal na string às vezes corta o texto no meio (`'Breaking Bad'` só digitou "Breaking").
  Mais confiável: `input text 'Breaking'` seguido de `input keyevent 62` (space) seguido de
  `input text 'Bad'`.
- Depois de logar uma vez, o token fica salvo (`EncryptedSharedPreferences`) e sobrevive a
  `adb install -r` — não precisa logar de novo a cada rebuild, só reabrir o app.

## Rodar no emulador

**AVD correto é `Pixel_8`** — não `Galaxy_S24` (nome antigo, referenciado em
`.claude/settings.json` de uma sessão anterior; o AVD foi recriado com outro nome desde então,
`emulator -list-avds` confirma o nome atual antes de assumir).

```bash
SDK="/c/Users/lucas/AppData/Local/Android/Sdk"
"$SDK/emulator/emulator.exe" -list-avds   # confirmar nome antes de assumir "Pixel_8"
nohup "$SDK/emulator/emulator.exe" -avd Pixel_8 -no-snapshot-load > /tmp/emulator.log 2>&1 &
disown
timeout 150 bash -c "until \"$SDK/platform-tools/adb.exe\" shell getprop sys.boot_completed 2>/dev/null | grep -q 1; do sleep 3; done"

"$SDK/platform-tools/adb.exe" install -r app/build/outputs/apk/debug/app-debug.apk
"$SDK/platform-tools/adb.exe" shell am start -n xyz.cqn.cqntrack.dev/xyz.cqn.cqntrack.MainActivity
```

**Esperar pelo menos 15-20s antes do primeiro screenshot** — o primeiro frame do Compose num
emulador x86_64 frio é lento de verdade (JIT compilando; logcat mostra "Davey! duration=7519ms" no
primeiro launch desta sessão). Um screenshot tirado 3s após o `am start` pegou tela preta mesmo sem
nenhum crash — não é sinal de bug, é sinal de esperar mais.

```bash
MSYS_NO_PATHCONV=1 "$SDK/platform-tools/adb.exe" shell screencap -p /sdcard/screen.png
MSYS_NO_PATHCONV=1 "$SDK/platform-tools/adb.exe" pull /sdcard/screen.png <scratchpad>/screen.png
```

Antes de declarar sucesso, sempre conferir logcat filtrado pelo PID do processo
(`adb shell ps | grep cqntrack` pro PID, depois `adb logcat -d --pid=<PID>`) — grep por
`FATAL`/`AndroidRuntime` sozinho pode não achar nada mesmo sem crash real (muito ruído de apps do
sistema no logcat geral), filtrar por PID é mais confiável que filtrar por texto.

## Pegadinhas de versão já resolvidas nesta sessão (não redescobrir)

Cadeia de upgrade forçada, uma dependência puxando a outra — todas as versões abaixo foram
confirmadas direto no Maven Central/Google Maven (`repo1.maven.org`, `dl.google.com`), não chutadas:

1. **Hilt 2.56 não lê metadata do Kotlin 2.4.x** — erro real: `Provided Metadata instance has
version 2.4.0, while maximum supported version is 2.2.0`. Corrigido com **Hilt 2.60.1**.
2. **Hilt 2.60.1 exige AGP 9.0+** (`hilt-android` recusa aplicar em AGP 8.x com esse erro
   explícito). Forçou upgrade pra **AGP 9.3.1**.
3. **AGP 9.3.x exige Gradle 9.5+** (checado nas release notes oficiais). Wrapper em **Gradle
   9.7.1**.
4. **AGP 9.0+ tem suporte a Kotlin embutido** — aplicar `org.jetbrains.kotlin.android`
   separadamente agora é _erro_ de build, não só redundância. Os módulos não declaram esse plugin;
   `kotlin.plugin.compose`/`kotlin.plugin.serialization`/`ksp`/`hilt.android` continuam sendo
   aplicados normalmente.
5. **`com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter` está descontinuado** —
   virou first-party do próprio Retrofit: `com.squareup.retrofit2:converter-kotlinx-serialization`
   (mesma versão do Retrofit core), mesmo pacote/API (`asConverterFactory`).
6. **`kotlinOptions { jvmTarget = "17" }` no bloco `android {}` está deprecated** — usar
   `kotlin { compilerOptions { jvmTarget.set(JvmTarget.JVM_17) } }` como bloco top-level do módulo.
7. **JUnit5 (Jupiter) precisa de `testRuntimeOnly("org.junit.platform:junit-platform-launcher")`**
   explícito — sem isso, `useJUnitPlatform()` compila mas falha em runtime com "Failed to load JUnit
   Platform".
8. **compileSdk/targetSdk 37** (não 36) — acompanha o Compose BOM 2026.08.00 e a AGP 9.3.x; SDK
   platform 37 e build-tools 36.0.0 já estão instalados nesta máquina.

Se uma dessas decisões precisar mudar (ex. downgrade de alguma lib), revisar a cadeia inteira — elas
são interdependentes, não escolhas isoladas.
