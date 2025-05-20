import RegisterForm from '@/components/Auth/RegisterForm';
import { toast } from '@/components/ToastManager'; // ✅ correct

export default function RegisterPage() {
  return (
    <div className="page-centered">
      <RegisterForm
        setToken={() => {}}
        onHide={() => {}}
        onLoginSuccess={() => {}}
        setAuthMode={() => {}}
      />
    </div>
  );
}
