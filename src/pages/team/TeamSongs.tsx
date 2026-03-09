import TeamLayout from "@/components/TeamLayout";
import SongListPage from "@/pages/SongList";

export default function TeamSongs() {
  return (
    <TeamLayout>
      <SongListPage embedded />
    </TeamLayout>
  );
}
