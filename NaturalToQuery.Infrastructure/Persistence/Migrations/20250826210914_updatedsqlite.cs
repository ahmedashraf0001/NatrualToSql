using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NaturalToQuery.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class updatedsqlite : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmbeddingStatus",
                table: "Profiles");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EmbeddingStatus",
                table: "Profiles",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);
        }
    }
}
