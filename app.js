
/* =========================================================
   INICIALIZAÇÃO
========================================================= */

function init() {
  loadState();

  let savedTheme = "dark";

  try {
    savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  } catch (error) {
    savedTheme = "dark";
  }

  applyTheme(savedTheme);
  bindEvents();

  try {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) currentUser = JSON.parse(session);
  } catch {
    currentUser = null;
  }

  if (currentUser) {
    const validUser = state.users.find(
      (user) => user.email === currentUser.email
    );

    if (validUser) {
      currentUser = validUser;
      saveSession(validUser);
      showApp();
      return;
    }

    saveSession(null);
  }

  showLogin();
  refreshDocuments();
}

init();
