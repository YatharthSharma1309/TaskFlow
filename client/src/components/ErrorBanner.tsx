type Props = {
  message: string;
  onDismiss: () => void;
  onRetry: () => void;
};

export default function ErrorBanner({ message, onDismiss, onRetry }: Props) {
  return (
    <div className="error-banner" role="alert">
      <p>{message}</p>
      <div className="error-actions">
        <button type="button" className="btn btn-ghost" onClick={onRetry}>Retry</button>
        <button type="button" className="btn btn-ghost" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
}
