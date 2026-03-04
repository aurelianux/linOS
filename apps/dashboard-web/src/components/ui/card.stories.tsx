import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Button } from "../components/ui/button";

const meta = {
  title: "UI/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => (
    <Card style={{ width: "400px" }}>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This is the main content of the card.</p>
      </CardContent>
      <CardFooter>
        <Button>Action</Button>
      </CardFooter>
    </Card>
  ),
};

export const WithContent: Story = {
  render: () => (
    <Card style={{ width: "500px" }}>
      <CardHeader>
        <CardTitle>System Status</CardTitle>
        <CardDescription>Current system health check</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <span className="text-slate-400">Status: </span>
          <span className="text-green-400">Operational</span>
        </div>
        <div>
          <span className="text-slate-400">Uptime: </span>
          <span className="text-slate-100">24 hours</span>
        </div>
      </CardContent>
    </Card>
  ),
};
