package xyz.cqn.cqntrack.manga.data

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object MangaModule {
    @Provides
    @Singleton
    fun provideMangaApi(retrofit: Retrofit): MangaApi = retrofit.create(MangaApi::class.java)
}
