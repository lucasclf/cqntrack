package xyz.cqn.cqntrack

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import dagger.hilt.android.AndroidEntryPoint
import xyz.cqn.cqntrack.core.designsystem.CqntrackTheme
import xyz.cqn.cqntrack.ui.navigation.CqntrackNavHost

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            CqntrackTheme {
                CqntrackNavHost()
            }
        }
    }
}
