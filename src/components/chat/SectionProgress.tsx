interface SectionProgressProps {
  title: string;
  total: number;
  completed: number;
}

export function SectionProgress({ title, total, completed }: SectionProgressProps) {
  return (
    <div key={title} className="animate-fade-in flex flex-col items-center gap-3 py-4">
      <p className="text-sm font-medium text-convo-muted">{title}</p>
      <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, index) => (
          <span
            key={index}
            className={`h-2 w-2 rounded-full transition-colors duration-300 ${
              index < completed ? "bg-convo-accent" : "bg-convo-line"
            }`}
          />
        ))}
      </div>
    </div>
  );
}