export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-sm font-medium text-coral-600" role="alert">
      {message}
    </p>
  );
}
