import { Composition, Still } from 'remotion';
import { Trailer, OgCard } from './Trailer';

const FPS = 30;
const SECONDS = 50;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Trailer" component={Trailer} durationInFrames={FPS * SECONDS} fps={FPS} width={1280} height={720} />
      <Still id="OgCard" component={OgCard} width={1200} height={630} />
    </>
  );
};
