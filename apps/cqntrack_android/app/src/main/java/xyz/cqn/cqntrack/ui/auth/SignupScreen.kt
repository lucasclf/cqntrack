package xyz.cqn.cqntrack.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import xyz.cqn.cqntrack.core.designsystem.PasswordOutlinedTextField

/**
 * Mesmo molde de LoginScreen.kt, com os campos extras de cadastro
 * (nome/username). Sucesso não faz login automático — ver comentário em
 * SignupUiState.signupSucceeded.
 */
@Composable
fun SignupScreen(onBackToLogin: () -> Unit, viewModel: SignupViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            Text(text = "cqntrack", style = MaterialTheme.typography.headlineMedium)
            Text(text = "Criar conta", style = MaterialTheme.typography.titleMedium)

            if (uiState.signupSucceeded) {
                Text(
                    text = "Cadastro criado! Confirme seu e-mail e depois entre com sua senha.",
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 16.dp),
                )
                Button(
                    onClick = onBackToLogin,
                    modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                ) {
                    Text("Ir para o login")
                }
                return@Scaffold
            }

            OutlinedTextField(
                value = uiState.name,
                onValueChange = viewModel::onNameChange,
                label = { Text("Nome") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            )
            OutlinedTextField(
                value = uiState.username,
                onValueChange = viewModel::onUsernameChange,
                label = { Text("Username") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
            OutlinedTextField(
                value = uiState.email,
                onValueChange = viewModel::onEmailChange,
                label = { Text("E-mail") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
            PasswordOutlinedTextField(
                value = uiState.password,
                onValueChange = viewModel::onPasswordChange,
                label = "Senha",
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )

            if (uiState.errorMessage != null) {
                Text(
                    text = uiState.errorMessage.orEmpty(),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }

            Button(
                onClick = viewModel::submit,
                enabled = !uiState.isLoading,
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            ) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp))
                } else {
                    Text("Criar conta")
                }
            }

            TextButton(
                onClick = onBackToLogin,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            ) {
                Text("Já tenho conta — entrar", textAlign = TextAlign.Center)
            }
        }
    }
}
