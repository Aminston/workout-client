import LoginForm from '@/components/Auth/LoginForm';
import { toast } from '@/components/ToastManager'; // ✅ correct

export default function LoginPage() {
  return (
    <div className="page-centered">
      <LoginForm
        setToken={() => {}}
        onHide={() => {}}
        onLoginSuccess={() => {}}
        setAuthMode={() => {}}
      />
    </div>
  );
}
