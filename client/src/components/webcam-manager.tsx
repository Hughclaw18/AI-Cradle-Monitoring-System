import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Webcam, InsertWebcam } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function WebcamManager() {
  const { toast } = useToast();
  const { data: webcams, isLoading } = useQuery<Webcam[]>({
    queryKey: ["/api/webcams"],
  });

  const deleteWebcamMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/webcams/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webcams"] });
      toast({ title: "Camera removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove camera", description: err.message, variant: "destructive" });
    }
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Camera Feeds</CardTitle>
        <AddWebcamDialog />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : webcams && webcams.length > 0 ? (
          <div className="space-y-3">
            {webcams.map((cam) => (
              <div key={cam.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="bg-white p-2 rounded-full border">
                    <Camera className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-900">{cam.name}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">{cam.url}</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => deleteWebcamMutation.mutate(cam.id)}
                  disabled={deleteWebcamMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500 text-sm">
            No cameras configured. Add one to start monitoring.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddWebcamDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("webrtc");

  const createWebcamMutation = useMutation({
    mutationFn: async (data: Omit<InsertWebcam, "userId">) => {
      const res = await apiRequest("POST", "/api/webcams", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webcams"] });
      setOpen(false);
      setName("");
      setUrl("");
      toast({ title: "Camera added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add camera", description: err.message, variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createWebcamMutation.mutate({ name, url, type, location: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8">
          <Plus className="h-4 w-4 mr-2" />
          Add Camera
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Camera Feed</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Crib Camera" />
          </div>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input value={url} onChange={e => setUrl(e.target.value)} required placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="webrtc">WebRTC (Viewer URL)</SelectItem>
                <SelectItem value="rtsp">RTSP (Stream URL)</SelectItem>
                <SelectItem value="mjpeg">MJPEG Stream</SelectItem>
                <SelectItem value="hls">HLS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={createWebcamMutation.isPending}>
            {createWebcamMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Camera
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
