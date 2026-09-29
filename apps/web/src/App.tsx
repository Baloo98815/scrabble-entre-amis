import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './state/AuthContext.js';
import { ThemeProvider } from './state/ThemeContext.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { ThemeToggle } from './components/ThemeToggle.js';
import { NavMenu } from './components/NavMenu.js';
import { HomePage } from './routes/HomePage.js';
import { LoginPage } from './routes/LoginPage.js';
import { JoinPage } from './routes/JoinPage.js';
import { GamePage } from './routes/GamePage.js';
import { SpectatePage } from './routes/SpectatePage.js';
import { HistoryPage } from './routes/HistoryPage.js';
import { SettingsPage } from './routes/SettingsPage.js';

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <ThemeToggle />
            <NavMenu />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/g/:inviteCode" element={<JoinPage />} />
              <Route path="/game/:gameId" element={<GamePage />} />
              <Route path="/watch/:inviteCode" element={<SpectatePage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
