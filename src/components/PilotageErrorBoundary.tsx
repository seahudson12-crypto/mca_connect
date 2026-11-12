import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export class PilotageErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { failed: boolean; message: string }> {
  state = { failed: false, message: "" };
  static getDerivedStateFromError(e: unknown) { return { failed: true, message: e instanceof Error ? e.message : String(e) }; }
  componentDidCatch(e: unknown) { console.error("[pilotage] erreur d’affichage :", e); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6"><h2 className="font-semibold">Impossible de charger le Centre de Pilotage MCA</h2><p className="text-sm text-muted-foreground">Les données sont indisponibles. Aucun chiffre n’a été remplacé par zéro.</p><pre className="whitespace-pre-wrap break-words rounded bg-muted p-3 text-xs">Erreur d’affichage : {this.state.message}</pre><Button onClick={() => { this.props.onReset(); this.setState({failed:false,message:""}); }}><RefreshCw className="mr-2 h-4 w-4"/>Réessayer</Button></div>;
  }
}