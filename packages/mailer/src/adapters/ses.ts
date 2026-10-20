// biome-ignore-all lint/style/useNamingConvention: SESv2's API uses PascalCase keys
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { formatAddress } from '../address.js'
import { type MailerAdapter, MailerError, type RenderedMessage } from '../port.js'

export interface SesClientLike {
  send(command: { input: SesSendEmailInput }): Promise<{ MessageId?: string }>
}

interface SesSendEmailInput {
  FromEmailAddress: string
  Destination: {
    ToAddresses: string[]
    CcAddresses?: string[] | undefined
    BccAddresses?: string[] | undefined
  }
  Content: {
    Simple: {
      Subject: { Data: string }
      Body: { Html: { Data: string }; Text: { Data: string } }
      Headers?: { Name: string; Value: string }[] | undefined
    }
  }
  ReplyToAddresses?: string[] | undefined
  EmailTags?: { Name: string; Value: string }[] | undefined
  ConfigurationSetName?: string | undefined
}

export interface SesAdapterOptions {
  region?: string | undefined
  accessKeyId?: string | undefined
  secretAccessKey?: string | undefined
  configurationSetName?: string | undefined
  client?: SesClientLike | undefined
}

export function sesAdapter(options: SesAdapterOptions = {}): MailerAdapter {
  const client: SesClientLike =
    options.client ??
    (new SESv2Client({
      ...(options.region !== undefined && { region: options.region }),
      ...(options.accessKeyId &&
        options.secretAccessKey && {
          credentials: {
            accessKeyId: options.accessKeyId,
            secretAccessKey: options.secretAccessKey,
          },
        }),
    }) as unknown as SesClientLike)

  return {
    name: 'ses',
    async send(message: RenderedMessage) {
      if (message.attachments?.length) {
        throw new MailerError('SES adapter does not support attachments (requires raw MIME)', {
          adapter: 'ses',
        })
      }

      const input: SesSendEmailInput = {
        FromEmailAddress: formatAddress(message.from),
        Destination: {
          ToAddresses: message.to.map(formatAddress),
          CcAddresses: message.cc?.map(formatAddress),
          BccAddresses: message.bcc?.map(formatAddress),
        },
        Content: {
          Simple: {
            Subject: { Data: message.subject },
            Body: { Html: { Data: message.html }, Text: { Data: message.text } },
            Headers: message.headers
              ? Object.entries(message.headers).map(([Name, Value]) => ({ Name, Value }))
              : undefined,
          },
        },
        ReplyToAddresses: message.replyTo ? [formatAddress(message.replyTo)] : undefined,
        EmailTags: message.tags
          ? Object.entries(message.tags).map(([Name, Value]) => ({ Name, Value }))
          : undefined,
        ConfigurationSetName: options.configurationSetName,
      }

      try {
        const result = await client.send(
          new SendEmailCommand(input) as { input: SesSendEmailInput },
        )
        if (!result.MessageId)
          throw new MailerError('SES returned no MessageId', { adapter: 'ses' })
        return { id: result.MessageId }
      } catch (cause) {
        if (cause instanceof MailerError) throw cause
        throw new MailerError('SES request failed', { adapter: 'ses', cause })
      }
    },
  }
}
