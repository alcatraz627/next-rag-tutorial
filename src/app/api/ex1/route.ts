import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { StreamingTextResponse, createStreamDataTransformer } from "ai";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import OpenAI from "openai";

// Optional, but recommended: run on the edge runtime.
// See https://vercel.com/docs/concepts/functions/edge-functions
export const runtime = "force-dynamic";

export async function POST(req: Request) {
  // Extract the `messages` from the body of the request
  const { messages } = (await req.json()) as {
    messages: OpenAI.Chat.Completions.ChatCompletionMessage[];
  };
  const message = messages.at(-1)?.content || "";
  const prompt = PromptTemplate.fromTemplate("{message}");

  // Request the OpenAI API for the response based on the prompt
  const model = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: 0.8,
    // stream: true,
    // messages: messages,
  });

  const parser = new HttpResponseOutputParser();
  const chain = prompt.pipe(model).pipe(parser);

  // Convert the response into a friendly text-stream
  const stream = await chain.stream({ message });

  // Respond with the stream
  return new StreamingTextResponse(
    stream.pipeThrough(createStreamDataTransformer())
  );
}
