# Four Together

Two-player online Connect Four. Browser interface, Node.js and Socket.IO. No accounts required for players.

## Run locally

Use Node.js 22 or later. Run `npm install`, `npm test`, then `npm start`. Open http://localhost:3000.

## Publish on Render

1. Upload this project to a GitHub repository (exclude node_modules).
2. In Render, choose New → Blueprint, connect the repository, and apply render.yaml. Alternatively create a Node web service with build command `npm install --omit=dev`, start command `npm start`, and health check `/health`.
3. Select one free instance and wait for deployment. Open the assigned HTTPS URL.
4. Create a room and send the invitation link to a second device.

Free services can sleep and take time to wake. Games are stored in server memory and reset on redeploy or restart. Use one server instance. A disconnected player's slot stays reserved for rejoining in the same browser; use a new room to change opponents. Completely disconnected rooms expire after one hour.

## Two-device acceptance check

- Laptop creates a room; phone on mobile data joins its invitation link.
- Both see the same board, and only the current player can move.
- Attempt full-column moves; verify horizontal, vertical, and diagonal wins.
- Both approve a rematch; verify a fresh board.
- Refresh one player; verify their identity and board are restored.
- Disconnect one device; the other sees feedback and moves pause.
- A third browser cannot take a player slot in a full room.

For submission, provide the public URL, brief play instructions, and a two-device demonstration if requested.
