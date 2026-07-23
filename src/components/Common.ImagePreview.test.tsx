import { describe, expect, it } from 'vitest';
import { act, create } from 'react-test-renderer';
import { ImagePreview } from './Common';

describe('ImagePreview', () => {
  it('resets error state when src changes', async () => {
    let tree: ReturnType<typeof create>;

    await act(async () => {
      tree = create(<ImagePreview src="/broken-a.png" alt="cover" />);
    });

    const firstImg = tree!.root.findByType('img');
    await act(async () => {
      firstImg.props.onError();
    });

    expect(tree!.root.findAllByType('img').length).toBe(0);

    await act(async () => {
      tree!.update(<ImagePreview src="/good-b.png" alt="cover" />);
    });

    const recoveredImg = tree!.root.findByType('img');
    expect(recoveredImg.props.src).toBe('/good-b.png');
  });

  it('shows the cover loading shimmer until the image settles', async () => {
    let tree: ReturnType<typeof create>;

    await act(async () => {
      tree = create(<ImagePreview src="/cover.png" alt="cover" />);
    });

    expect(tree!.root.findAll((node) => node.props.className?.includes('cover-loading-shimmer'))).toHaveLength(1);
    const image = tree!.root.findByType('img');
    await act(async () => image.props.onLoad({}));
    expect(tree!.root.findAll((node) => node.props.className?.includes('cover-loading-shimmer'))).toHaveLength(0);
  });
});
