package xyz.cqn.cqntrack.social.data

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object SocialModule {
    @Provides
    @Singleton
    fun provideSocialApi(retrofit: Retrofit): SocialApi = retrofit.create(SocialApi::class.java)
}
