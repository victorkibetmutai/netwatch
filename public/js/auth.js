const form = document.getElementById('auth-form');
const modeButton = document.getElementById('auth-mode');
const submitButton = document.getElementById('auth-submit');
const errorElement = document.getElementById('auth-error');
const description = document.getElementById('auth-description');
let registerMode = false;

modeButton.addEventListener('click', () => {
  registerMode = !registerMode;
  submitButton.textContent = registerMode ? 'Register' : 'Login';
  description.textContent = registerMode
    ? 'Create the first administrator account.'
    : 'Use your NetWatch account.';
  modeButton.textContent = registerMode ? 'Back to login' : 'Create the first account';
  document.getElementById('password').autocomplete = registerMode
    ? 'new-password'
    : 'current-password';
  errorElement.classList.add('hidden');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  if (username.length < 3 || password.length < 8) {
    errorElement.textContent = 'Enter a username of at least 3 characters and a password of at least 8 characters.';
    errorElement.classList.remove('hidden');
    return;
  }

  try {
    const response = await fetch(registerMode ? '/api/auth/register' : '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Authentication failed');
    localStorage.setItem('netwatch-token', body.token);
    localStorage.setItem('netwatch-user', body.username);
    window.location.href = '/';
  } catch (error) {
    errorElement.textContent = error.message;
    errorElement.classList.remove('hidden');
  }
});
