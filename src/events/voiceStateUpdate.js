import { ChannelType } from "discord.js";
import { log } from "../utils/logger.js";

const loggedDeleted = new Set();

export default async (client, oldState, newState) => {
  const oldChannel = oldState.channel;
  const newChannel = newState.channel;
  const member = newState.member || oldState.member;

  if (oldChannel && oldChannel.id !== newChannel?.id) {
    const isTempChannel = client.tempVoiceOwners.has(oldChannel.id);
    if (isTempChannel && oldChannel.members.size === 0) {
      await deleteChannel(oldChannel, client);
    }
  }

  if (newChannel && newChannel.id === process.env.VOICE_CHANNEL_ID) {
    try {
      const tempChannel = await newChannel.guild.channels.create({
        name: `${member.user.displayName}'s Room`,
        type: ChannelType.GuildVoice,
        parent: process.env.CATEGORY_CHANNEL_ID,
      });

      await newState.setChannel(tempChannel);

      client.tempVoiceOwners.set(tempChannel.id, member.id);

      log("log_switched", client, {
        user: member.user.username,
        from: newChannel.name,
        to: tempChannel.name,
      });
    } catch (error) {
      console.error("Error creating temporary channel:", error);
      log("log_channel_create_failed", client, {
        user: member.user.username,
        error: error.message,
      });
    }
  } else if (!oldChannel && newChannel) {
    log("log_joined", client, {
      user: member.user.username,
      channel: newChannel.name,
    });
  }
};

async function deleteChannel(channel, client) {
  if (!client.channels.cache.has(channel.id)) return;

  try {
    const channelName = channel.name;
    await channel.delete("Temporary channel empty.");

    if (!loggedDeleted.has(channel.id)) {
      log("log_deleted", client, { channel: channelName });
      loggedDeleted.add(channel.id);
    }

    client.tempVoiceOwners.delete(channel.id);
    setTimeout(() => loggedDeleted.delete(channel.id), 60000);
  } catch (err) {
    if (err.code !== 10003) {
      log("log_channel_delete_failed", client, { channel: channel.name });
      console.error(`Failed to delete channel ${channel.name}:`, err);
    }
  }
}
