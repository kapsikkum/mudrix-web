# Notification sound pack sources

These sounds are copied unmodified from other open-source Matrix clients so users can pick a
familiar notification sound. Mudrix itself is AGPL-3.0.

| Pack | Source repository | Licence of source | Files |
| --- | --- | --- | --- |
| wizardchat | gitlab.com/wizardchat/wizardchat-web (`public/assets/sounds/alert.mp3`) | AGPL-3.0 (the upstream Mudrix is forked from) | alert -> message |
| element | element-hq/element-web (`res/media`) | AGPL-3.0-only OR GPL-3.0-only OR commercial (used under AGPL-3.0) | message, ring, ringback, callend |
| cinny | cinnyapp/cinny (`public/sound`) | AGPL-3.0 (repository licence; no separate sound licence stated) | notification -> message, invite -> mention |
| fluffychat | krille-chan/fluffychat (`assets/sounds`) | Sounds are CC-BY-4.0, copyright Pixabay (per REUSE.toml); app is AGPL-3.0 | notification -> message, call_attention -> mention, call_ring -> ring, call_leave -> callend |
| commet | commetchat/commet (`commet/assets/sound`) | AGPL-3.0 (repository licence; no separate sound licence stated) | message, left_call -> callend |
| lightning | Lightning client (`data/sounds`) | GPL-3.0 (compatible with AGPL-3.0 via GPLv3 section 13) | message, mention |

Attribution for CC-BY-4.0 material: FluffyChat sounds by Pixabay, https://creativecommons.org/licenses/by/4.0/

Skipped: trinity-matrix-client (MIT) ships no sound files, so there is no pack for it.
