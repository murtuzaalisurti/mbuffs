import { Wrench } from "lucide-react";

const Maintenance = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center rounded-lg border border-border bg-card/90 p-8 shadow-sm max-w-md">
        <div className="flex justify-center mb-4">
          <Wrench className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-4 text-foreground">Under Maintenance</h1>
        <p className="text-lg text-muted-foreground mb-2">
          mbuffs is temporarily unavailable while we perform scheduled maintenance.
        </p>
        <p className="text-sm text-muted-foreground">
          We'll be back shortly. Thanks for your patience!
        </p>
      </div>
    </div>
  );
};

export default Maintenance;
