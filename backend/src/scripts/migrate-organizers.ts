import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Data migration: Assign organizers to existing PaymentEvents
 *
 * Strategy: Assign each event to the first workspace admin
 * If no admin found, assign to first circle member
 */
async function migrateOrganizers() {
  console.log("\n🔄 Starting organizer migration...\n");

  const eventsWithoutOrganizer = await prisma.paymentEvent.findMany({
    where: { organizerId: null },
    include: {
      circle: {
        include: {
          workspace: {
            include: {
              members: {
                where: { role: "ADMIN" },
                take: 1,
              },
            },
          },
          members: {
            take: 1,
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  console.log(`Found ${eventsWithoutOrganizer.length} events without organizers\n`);

  let assigned = 0;
  let skipped = 0;

  for (const event of eventsWithoutOrganizer) {
    // Try to get workspace admin first
    const workspaceAdmin = event.circle.workspace.members[0];
    const firstMember = event.circle.members[0];

    const organizerId = workspaceAdmin?.userId || firstMember?.userId;

    if (organizerId) {
      await prisma.paymentEvent.update({
        where: { id: event.id },
        data: {
          organizerId,
          poolBalance: 0, // Initialize pool balance
        },
      });

      console.log(
        `✅ Event "${event.title}" (${event.id.substring(0, 8)}...) → Organizer: ${organizerId.substring(0, 8)}...`
      );
      assigned++;
    } else {
      console.warn(
        `⚠️  Skipped event "${event.title}" (${event.id.substring(0, 8)}...) - No members found`
      );
      skipped++;
    }
  }

  console.log(`\n✨ Migration complete!`);
  console.log(`   - Assigned: ${assigned}`);
  console.log(`   - Skipped: ${skipped}\n`);
}

migrateOrganizers()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
