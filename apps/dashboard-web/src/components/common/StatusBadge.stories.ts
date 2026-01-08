import type { Meta, StoryObj } from "@storybook/react";
import { StatusBadge } from "../components/common/StatusBadge";

const meta = {
  title: "Common/StatusBadge",
  component: StatusBadge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ok: Story = {
  args: {
    status: "ok",
  },
};

export const Error: Story = {
  args: {
    status: "error",
  },
};

export const Warning: Story = {
  args: {
    status: "warning",
  },
};

export const Offline: Story = {
  args: {
    status: "offline",
  },
};
