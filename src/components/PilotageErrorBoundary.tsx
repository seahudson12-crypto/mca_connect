import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export class PilotageErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6"><h2 className="font-semibold">Impossible de charger le Centre de Pilotage MCA</h2><p className="text-sm text-muted-foreground">Les données sont indisponibles. Aucun chiffre n’a été remplacé par zéro.</p><Button onClick={() => { this.props.onReset(); this.setState({failed:false}); }}><RefreshCw className="mr-2 h-4 w-4"/>Réessayer</Button></div>;
  }
}