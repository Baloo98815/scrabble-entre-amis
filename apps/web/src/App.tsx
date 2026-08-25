import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './state/AuthContext.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { HomePage } from './routes/HomePage.js';
import { LoginPage } from './routes/LoginPage.js';
import { JoinPage } from './routes/JoinPage.js';
import { GamePage } from './routes/GamePage.js';
import { SpectatePage } from './routes/SpectatePage.js';
import { HistoryPage } from './routes/HistoryPage.js';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/g/:inviteCode" element={<JoinPage />} />
            <Route path="/game/:gameId" element={<GamePage />} />
            <Route path="/watch/:inviteCode" element={<SpectatePage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}
