package xyz.cqn.cqntrack.games.data

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object GamesModule {
    @Provides
    @Singleton
    fun provideGamesApi(retrofit: Retrofit): GamesApi = retrofit.create(GamesApi::class.java)

    @Provides
    @Singleton
    fun provideGameListsApi(retrofit: Retrofit): GameListsApi = retrofit.create(GameListsApi::class.java)
}
