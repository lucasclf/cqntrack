package xyz.cqn.cqntrack.update.data

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Qualifier
import javax.inject.Singleton

/** Distingue o Retrofit da api.github.com do Retrofit principal (api.track.cqn.xyz.br, ver NetworkModule) — evita enviar o Bearer token da sessão pra um host de terceiro. */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class GithubApi

@Module
@InstallIn(SingletonComponent::class)
object UpdateModule {

    @Provides
    @Singleton
    @GithubApi
    fun provideGithubOkHttpClient(): OkHttpClient =
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .build()

    @Provides
    @Singleton
    @GithubApi
    fun provideGithubRetrofit(@GithubApi client: OkHttpClient, json: Json): Retrofit {
        val contentType = "application/json".toMediaType()
        return Retrofit.Builder()
            .baseUrl("https://api.github.com/")
            .client(client)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
    }

    @Provides
    @Singleton
    fun provideUpdateApi(@GithubApi retrofit: Retrofit): UpdateApi = retrofit.create(UpdateApi::class.java)
}
