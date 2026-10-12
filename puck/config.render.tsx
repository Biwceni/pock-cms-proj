import type { Config } from '@puckeditor/core';
import { blockRegistry } from '@/src/puck/blocks/registry';

export const renderConfig: Config = {
  components: {
    Banner: { render: blockRegistry.Banner.render },
    CardGrid: { render: blockRegistry.CardGrid.render },
    Heading: { render: blockRegistry.Heading.render },
    Text: { render: blockRegistry.Text.render },
    Image: { render: blockRegistry.Image.render },
    Button: { render: blockRegistry.Button.render },
    Spacer: { render: blockRegistry.Spacer.render },
  },
};
