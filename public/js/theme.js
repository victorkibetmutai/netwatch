const toggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('netwatch-theme');

if (savedTheme === 'light') {
  document.documentElement.dataset.theme = 'light';
}

toggle?.addEventListener('click', () => {
  const isLight = document.documentElement.dataset.theme === 'light';
  if (isLight) {
    delete document.documentElement.dataset.theme;
    localStorage.setItem('netwatch-theme', 'dark');
  } else {
    document.documentElement.dataset.theme = 'light';
    localStorage.setItem('netwatch-theme', 'light');
  }
});
