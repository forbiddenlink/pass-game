import { Composition } from 'remotion';
import { Trailer } from './Trailer';

const FPS = 30;
const SECONDS = 50;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Trailer"
      component={Trailer}
      durationInFrames={FPS * SECONDS}
      fps={FPS}
      width={1280}
      height={720}
    />
  );
};
