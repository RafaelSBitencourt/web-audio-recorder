import { useState } from 'react';
import { Mail, Lock, UserPlus, LogIn } from 'lucide-react';
import { authService, isMockMode } from '../lib/supabase';

interface AuthProps {
  onAuthSuccess: () => void;
}

export function Auth({ onAuthSuccess }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error: signUpErr } = await authService.signUp(email, password);
        if (signUpErr) throw signUpErr;
        // Auto sign-in or success
        onAuthSuccess();
      } else {
        const { error: signInErr } = await authService.signIn(email, password);
        if (signInErr) throw signInErr;
        onAuthSuccess();
      }
    } catch (err) {
      console.error('[Auth] Error submitting form:', err);
      setError((err as Error).message || 'Ocorreu um erro ao processar sua solicitação.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'github' | 'google') => {
    setIsLoading(true);
    setError(null);

    try {
      if (isMockMode) {
        // In Mock Mode, simulate a social sign in immediately
        const mockEmail = `${provider}_user@recorder.local`;
        await authService.signUp(mockEmail, 'mockpassword123');
        onAuthSuccess();
      } else {
        // Real Supabase SSO would go here (configured on Supabase Dashboard)
        // Since it redirects, we trigger supabase auth
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        
        const { error: socialErr } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: window.location.origin
          }
        });
        if (socialErr) throw socialErr;
      }
    } catch (err) {
      console.error(`[Auth] Error signing in with ${provider}:`, err);
      setError(`Erro ao autenticar com o ${provider}: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        {isMockMode && (
          <div style={{ alignSelf: 'center', marginBottom: -10 }}>
            <span className="badge-mock">Mock Mode Ativo</span>
          </div>
        )}

        <div className="auth-header">
          <h2 className="auth-title">
            {isSignUp ? 'Criar Conta' : 'Acesse sua Conta'}
          </h2>
          <p className="auth-subtitle">
            {isSignUp 
              ? 'Cadastre-se para salvar e gerenciar suas gravações de áudio' 
              : 'Entre para acessar seu histórico e gravar novos áudios'}
          </p>
        </div>

        {error && (
          <div className="error-banner">
            <span>{error}</span>
          </div>
        )}

        {isMockMode && !isSignUp && (
          <div style={{ fontSize: 12, padding: 12, backgroundColor: 'var(--ui-accent-light)', border: '1px solid var(--ui-border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}>
            <strong>Offline / Local Mode:</strong> Qualquer email e senha (mínimo de 6 caracteres) podem ser usados. Suas gravações ficarão armazenadas localmente no IndexedDB do seu navegador.
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="email">E-mail</label>
            <div style={{ position: 'relative' }}>
              <input
                id="email"
                type="email"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={{ width: '100%', paddingLeft: 40 }}
                required
              />
              <Mail size={16} style={{ position: 'absolute', left: 14, top: 15, color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{ width: '100%', paddingLeft: 40 }}
                required
                minLength={6}
              />
              <Lock size={16} style={{ position: 'absolute', left: 14, top: 15, color: 'var(--text-muted)' }} />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 }}
          >
            {isSignUp ? <UserPlus size={18} /> : <LogIn size={18} />}
            <span>{isLoading ? 'Aguarde...' : isSignUp ? 'Cadastrar' : 'Entrar'}</span>
          </button>
        </form>

        <div className="divider">Ou continue com</div>

        <div className="social-auth">
          <button 
            className="btn-social" 
            onClick={() => handleSocialLogin('github')}
            disabled={isLoading}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
            <span>GitHub</span>
          </button>
          
          <button 
            className="btn-social" 
            onClick={() => handleSocialLogin('google')}
            disabled={isLoading}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.111 4.114-3.555 0-6.438-2.883-6.438-6.438s2.883-6.438 6.438-6.438c1.611 0 3.078.59 4.219 1.562l3.164-3.164C19.336 2.102 15.992 1 12.24 1s-7.24 3.24-7.24 7.24 3.24 7.24 7.24 7.24c7.24 0 7.828-5.078 7.828-7.24v-.755H12.24z"/></svg>
            <span>Google</span>
          </button>
        </div>

        <div className="auth-footer">
          {isSignUp ? (
            <>
              Já tem uma conta?{' '}
              <span className="auth-link" onClick={() => setIsSignUp(false)}>
                Entrar
              </span>
            </>
          ) : (
            <>
              Não tem conta?{' '}
              <span className="auth-link" onClick={() => setIsSignUp(true)}>
                Cadastre-se
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Auth;
