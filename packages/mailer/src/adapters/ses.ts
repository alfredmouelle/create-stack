// biome-ignore-all lint/style/useNamingConvention: SESv2's API uses PascalCase keys
import { SESv2Client, SendEmailCommand, type SendEmailCommandInput } from '@aws-sdk/client-sesv2'
import { formatAddress } from '../address.js'
import { type MailerAdapter, MailerError, type RenderedMessage } from '../port.js'

export interface SesClientLike {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- AWS requires its mutable command contract
  send(command: SendEmailCommand): Promise<{ readonly MessageId?: string }>
}

export interface SesAdapterOptions {
  readonly region?: string | undefined
  readonly accessKeyId?: string | undefined
  readonly secretAccessKey?: string | undefined
  readonly configurationSetName?: string | undefined
  readonly client?: SesClientLike | undefined
}

function createInput(
  message: RenderedMessage,
  configurationSetName: string | undefined,
): SendEmailCommandInput {
  return {
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
    ConfigurationSetName: configurationSetName,
  }
}

export function sesAdapter(options: SesAdapterOptions = {}): MailerAdapter {
  const client =
    options.client ??
    new SESv2Client({
      ...(options.region !== undefined && { region: options.region }),
      ...(options.accessKeyId !== undefined &&
        options.accessKeyId !== '' &&
        options.secretAccessKey !== undefined &&
        options.secretAccessKey !== '' && {
          credentials: {
            accessKeyId: options.accessKeyId,
            secretAccessKey: options.secretAccessKey,
          },
        }),
    })

  return {
    name: 'ses',
    async send(message: RenderedMessage) {
      if ((message.attachments?.length ?? 0) > 0) {
        throw new MailerError('SES adapter does not support attachments (requires raw MIME)', {
          adapter: 'ses',
        })
      }

      try {
        const result = await client.send(
          new SendEmailCommand(createInput(message, options.configurationSetName)),
        )
        if (result.MessageId === undefined || result.MessageId === '')
          throw new MailerError('SES returned no MessageId', { adapter: 'ses' })
        return { id: result.MessageId }
      } catch (cause) {
        if (cause instanceof MailerError) throw cause
        throw new MailerError('SES request failed', { adapter: 'ses', cause })
      }
    },
  }
}
